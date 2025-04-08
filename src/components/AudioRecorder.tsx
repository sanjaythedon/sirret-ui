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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Process and send accumulated audio every 3 seconds
  const startProcessingAudio = () => {
    // Clear existing interval if any
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
    }

    processingIntervalRef.current = setInterval(() => {
      if (audioChunksRef.current.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
        // Create a complete audio file from accumulated chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Only send if we have enough audio data (50KB minimum)
        if (audioBlob.size > 50000) {
          console.log(`Sending audio chunk of size ${audioBlob.size} bytes`);
          socketRef.current.send(audioBlob);
          
          // Clear the chunks after sending
          audioChunksRef.current = [];
        }
      }
    }, 3000); // Process every 3 seconds
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      onStreamingStart();
      audioChunksRef.current = []; // Reset audio chunks
      
      // First establish the WebSocket connection
      await setupWebSocket();
      
      // Then start accessing the media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Configure the MediaRecorder for real-time streaming
      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event listener to accumulate audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start recording with small time slices
      mediaRecorder.start(500); // Collect data every 500ms
      
      // Start the interval to process and send accumulated audio
      startProcessingAudio();
      
      // Start a timer to show recording duration
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingDuration(seconds);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      if (socketRef.current) {
        socketRef.current.close();
      }
      toast.error('Failed to start recording');
    }
  };
  
  const stopRecording = () => {
    setIsRecording(false);
    
    // Stop the processing interval
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Send any remaining audio data
    if (audioChunksRef.current.length > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
      const finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      socketRef.current.send(finalAudioBlob);
      audioChunksRef.current = [];
    }
    
    // Send end-of-stream marker (single byte with value 255)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        const endMarker = new Uint8Array([255]);
        socketRef.current?.send(endMarker);
      }, 1000); // Give a second for the final audio to be processed
    }
    
    // Clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setRecordingDuration(0);
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