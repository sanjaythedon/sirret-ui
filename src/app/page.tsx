'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  const handleAudioData = async (audioBlob: Blob) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      
      const response = await fetch('http://localhost:8000/transcribe/', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to transcribe audio');
      }
      
      const data = await response.json();
      setGroceryItems(data);
      toast.success('Grocery list updated');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error processing your recording');
    } finally {
      setIsLoading(false);
    }
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
            <p className="mb-4">Speak your grocery list in Tamil or English. Include weights (like "500 grams", "1 kg") and quantities for each item.</p>
            <AudioRecorder onAudioRecorded={handleAudioData} isLoading={isLoading} />
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
                Your grocery list will appear here after recording
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Toaster />
    </main>
  );
}
