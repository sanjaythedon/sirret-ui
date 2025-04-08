'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onStreamingStart: () => void;
  onGroceryItemReceived: (item: any) => void;
  onStreamingComplete: () => void;
  isLoading: boolean;
}

export default function AudioRecorder({ 
  onStreamingStart, 
  onGroceryItemReceived, 
  onStreamingComplete, 
  isLoading 
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  // Use ref to track recording state to avoid closure issues
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkStartTimeRef = useRef<number>(0);

  // Keep isRecordingRef in sync with isRecording state
  useEffect(() => {
    isRecordingRef.current = isRecording;
    console.log(`Recording state changed: ${isRecording}`);
  }, [isRecording]);

  // Close WebSocket on component unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
    };
  }, []);

  const setupWebSocket = async () => {
    // Use the production URL in production, and localhost in development
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://your-production-domain/prod/ws/stream-audio/'
      : 'ws://localhost:8000/ws/stream-audio/';
    
    return new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
  
      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        resolve(socket);
      };
  
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'completed') {
            console.log('Streaming completed');
            onStreamingComplete();
          } else if (data.error) {
            console.error('Error from server:', data.error);
          } else {
            // Received a grocery item
            console.log('Received grocery item:', data);
            onGroceryItemReceived(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
  
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
  
      socket.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
      };
    });
  };

  // Start periodic capturing of audio segments
  const startSegmentCapture = () => {
    // Clear existing interval if any
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    console.log("Setting up audio capture segments");
    
    // Use a separate function for capturing segments
    let segmentCount = 0;
    
    // Function to handle each segment
    const handleSegment = () => {
      // Check recording state from ref, not from state variable
      if (!isRecordingRef.current) {
        console.log("Skipping segment: not recording anymore");
        return;
      }
      
      // Check other resources
      if (!streamRef.current) {
        console.log("Skipping segment: no audio stream available");
        return;
      }
      
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.log("Skipping segment: WebSocket not connected");
        return;
      }
      
      segmentCount++;
      console.log(`Starting segment #${segmentCount} - recording state: ${isRecordingRef.current}`);
      
      try {
        // Create a new MediaRecorder for this segment
        const segmentRecorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];
        
        // Set up event handlers
        segmentRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            console.log(`Got data for segment #${segmentCount}: ${event.data.size} bytes`);
          }
        };
        
        segmentRecorder.onstop = () => {
          console.log(`Segment #${segmentCount} completed`);
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          
          if (audioBlob.size > 5000 && socketRef.current?.readyState === WebSocket.OPEN) {
            console.log(`Sending segment #${segmentCount}: ${audioBlob.size} bytes`);
            socketRef.current.send(audioBlob);
          } else {
            console.log(`Segment #${segmentCount} not sent: too small or socket closed`);
          }
        };
        
        // Start with a timeout to ensure we get data
        segmentRecorder.start(100);
        
        // Stop after 3 seconds
        setTimeout(() => {
          if (segmentRecorder.state !== 'inactive') {
            console.log(`Stopping segment #${segmentCount}`);
            segmentRecorder.stop();
          }
        }, 3000);
      } catch (error) {
        console.error(`Error in segment #${segmentCount}:`, error);
      }
    };
    
    // Run immediately for first segment
    console.log("Starting first segment immediately");
    handleSegment();
    
    // Then set up interval for additional segments
    console.log("Setting up interval for future segments");
    processingIntervalRef.current = setInterval(() => {
      console.log("Interval triggered, recording state:", isRecordingRef.current);
      handleSegment();
    }, 3500);
  };

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      
      // Update both state and ref
      setIsRecording(true);
      isRecordingRef.current = true;
      
      onStreamingStart();
      
      // First establish the WebSocket connection
      console.log('Setting up WebSocket...');
      await setupWebSocket();
      
      // Then start accessing the media stream
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Configure the main MediaRecorder
      console.log('Setting up main MediaRecorder...');
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Start recording
      mediaRecorder.start();
      
      // Start capturing audio segments
      console.log('Starting segment capture...');
      startSegmentCapture();
      
      // Start a timer to show recording duration
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingDuration(seconds);
      }, 1000);
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      isRecordingRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
      }
      toast.error('Failed to start recording');
    }
  };
  
  const stopRecording = () => {
    console.log('Stopping recording...');
    
    // Update both state and ref
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // Stop the processing interval
    if (processingIntervalRef.current) {
      console.log('Clearing processing interval');
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('Stopping main media recorder');
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      console.log('Stopping all audio tracks');
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Send end-of-stream marker
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending end-of-stream marker');
      setTimeout(() => {
        const endMarker = new Uint8Array([255]);
        socketRef.current?.send(endMarker);
        console.log('End-of-stream marker sent');
      }, 1000); // Give a second for any final processing
    }
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setRecordingDuration(0);
    console.log('Recording stopped');
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      {isRecording ? (
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse mr-2"></div>
            <span className="text-sm font-medium">Recording: {formatTime(recordingDuration)}</span>
          </div>
        </div>
      ) : null}
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {!isRecording ? (
          <Button 
            onClick={startRecording} 
            disabled={isLoading}
            className="px-6"
          >
            Start Recording
          </Button>
        ) : (
          <Button 
            onClick={stopRecording} 
            variant="destructive"
            className="px-6"
          >
            Stop Recording
          </Button>
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            <span className="text-sm">Processing...</span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-500 mt-2">
        Speak clearly in Tamil or English with quantities for best results
      </p>
    </div>
  );
} 