'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import AudioRecorder from '@/components/AudioRecorder';
import GroceryTable from '@/components/GroceryTable';

type GroceryItem = {
  tamil_name: string;
  english_name: string;
  weight: string;
  quantity?: number | null;
};

export default function Home() {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamingStart = () => {
    setIsLoading(true);
    setIsStreaming(true);
    // Clear previous results when starting a new recording
    setGroceryItems([]);
    toast.info('Recording started');
  };

  const handleGroceryItemReceived = (item: GroceryItem) => {
    setGroceryItems(prevItems => [...prevItems, item]);
    // Briefly flash a loading state off to show progress
    setIsLoading(false);
    setTimeout(() => {
      if (isStreaming) {
        setIsLoading(true);
      }
    }, 300);
  };

  const handleStreamingComplete = () => {
    setIsLoading(false);
    setIsStreaming(false);
    toast.success('Grocery list updated');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8">Grocery List Speech Recognition</h1>
      
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Record Grocery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Speak your grocery list in Tamil or English. Include weights (like 500 grams, 1 kg) and quantities for each item.</p>
            <AudioRecorder 
              onStreamingStart={handleStreamingStart}
              onGroceryItemReceived={handleGroceryItemReceived}
              onStreamingComplete={handleStreamingComplete}
              isLoading={isLoading} 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Your Grocery List</CardTitle>
          </CardHeader>
          <CardContent>
            {groceryItems.length > 0 ? (
              <GroceryTable items={groceryItems} />
            ) : (
              <p className="text-center text-gray-500 my-8">
                Your grocery list will appear here as you speak
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Toaster />
    </main>
  );
}
