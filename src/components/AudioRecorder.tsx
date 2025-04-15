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
    // const wsUrl = process.env.NODE_ENV === 'production' 
    //   ? 'wss://your-production-domain/prod/ws/stream-audio/'
    //   : 'ws://localhost:8000/ws/stream-audio/';

    // const wsUrl = 'ws://localhost:8000/ws/stream-audio/';
    const wsUrl = 'wss://e2plx8os7h.execute-api.ap-south-1.amazonaws.com/prod';
    
    return new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
  
      socket.onopen = () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        
        // Send a test message to verify the connection is working
        try {
          console.log('Sending test message...');
          socket.send(JSON.stringify({
            action: 'test',
            message: 'Testing connection'
          }));
        } catch (error) {
          console.error('Error sending test message:', error);
        }
        
        resolve(socket);
      };
  
      socket.onmessage = (event) => {
        try {
          console.log('Received message from server:', event.data);
          
          // Make sure we have data
          if (!event.data) {
            console.warn('Received empty message from server');
            return;
          }
          
          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.error('Error parsing WebSocket message:', parseError);
            console.warn('Received non-JSON message:', event.data);
            return;
          }
          
          // Process the parsed data
          if (data.status === 'completed') {
            console.log('Streaming completed');
            onStreamingComplete();
          } else if (data.error) {
            console.error('Error from server:', data.error);
            toast.error(`Server error: ${data.error}`);
          } else if (data.status === 'test_received') {
            console.log('Test message received by server');
          } else if (data.message) {
            console.log('Message from server:', data.message);
          } else {
            // Received a grocery item
            console.log('Received grocery item:', data);
            onGroceryItemReceived(data);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
  
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection error');
        reject(error);
      };
  
      socket.onclose = (event) => {
        console.log('WebSocket connection closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsConnected(false);
        
        // Show toast based on close code
        if (event.code === 1006) {
          toast.error('Connection closed abnormally. Please try again.');
        } else if (!event.wasClean) {
          toast.error(`Connection closed: ${event.reason || 'Unknown reason'}`);
        }
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
      
      if (!socketRef.current) {
        console.log("Skipping segment: WebSocket not available");
        return;
      }
      
      if (socketRef.current.readyState !== WebSocket.OPEN) {
        console.log(`Skipping segment: WebSocket not open (state: ${socketRef.current.readyState})`);
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
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob); 
            reader.onloadend = function() {
              const result = reader.result;
              if (result && typeof result === 'string') {
                const base64data = result.split(',')[1]; // Remove the data URL prefix
                
                // Calculate size to inform user
                const base64Size = base64data.length;
                console.log(`Base64 data size: ${base64Size} chars`);
                
                // Check if size is too large
                if (base64Size > 100000) {
                  console.warn('Audio data is very large, might cause issues with WebSocket');
                }
                
                // Check WebSocket state again before sending
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                  // Send as a JSON message
                  try {
                    socketRef.current.send(JSON.stringify({
                      action: 'audio',
                      data: base64data
                    }));
                    console.log(`Sent base64 encoded audio data: ${base64data.length} chars`);
                  } catch (error) {
                    console.error('Error sending audio data:', error);
                  }
                } else {
                  console.error(`Cannot send: WebSocket not open (readyState: ${socketRef.current?.readyState})`);
                }
              }
            }
          } else {
            console.log(`Segment #${segmentCount} not sent: ${!audioBlob || audioBlob.size <= 5000 ? 'too small' : 'socket closed'}`);
          }
        };
        
        // Start with a timeout to ensure we get data
        segmentRecorder.start(100);
        
        // Stop after 2 seconds to create smaller chunks
        setTimeout(() => {
          if (segmentRecorder.state !== 'inactive') {
            console.log(`Stopping segment #${segmentCount}`);
            segmentRecorder.stop();
          }
        }, 2000); // Reduced from 3000ms to 2000ms
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
      // Check if WebSocket is still open
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        console.error(`WebSocket not open in interval (state: ${socketRef.current?.readyState})`);
        // Try to reconnect?
        if (isRecordingRef.current) {
          toast.error('WebSocket connection lost. Recording may be interrupted.');
        }
      } else {
        handleSegment();
      }
    }, 2010); // Reduced from 3500ms to 2500ms
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
      // const options = { mimeType: 'audio/webm' };
      // const mediaRecorder = new MediaRecorder(stream, options);
      // mediaRecorderRef.current = mediaRecorder;
      
      // // Start recording
      // mediaRecorder.start();
      
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
    
    // Send end-of-stream marker as JSON
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending end-of-stream marker');
      setTimeout(() => {
        socketRef.current?.send(JSON.stringify({
          action: 'end',
          message: 'Recording complete'
        }));
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