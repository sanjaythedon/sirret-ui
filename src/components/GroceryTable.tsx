'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

type GroceryItem = {
  tamil_name: string;
  english_name: string;
  weight: string;
  quantity?: number | null;
};

interface GroceryTableProps {
  items: GroceryItem[];
}

export default function GroceryTable({ items }: GroceryTableProps) {
  const [visibleItems, setVisibleItems] = useState<GroceryItem[]>([]);

  // Effect to animate new items appearing
  useEffect(() => {
    // If we receive new items
    if (items.length > visibleItems.length) {
      // Add each new item with a small delay
      const newItemIndex = visibleItems.length;
      const timer = setTimeout(() => {
        setVisibleItems(prevItems => [...prevItems, items[newItemIndex]]);
      }, 300); // Small delay for animation effect
      
      return () => clearTimeout(timer);
    }
    // If items were reset (cleared), reset visible items too
    else if (items.length === 0) {
      setVisibleItems([]);
    }
  }, [items, visibleItems.length]);

  const handleExportToExcel = () => {
    // Create a worksheet
    const worksheet = XLSX.utils.json_to_sheet(
      items.map(item => ({
        'Tamil Name': item.tamil_name,
        'English Name': item.english_name,
        'Weight': item.weight,
        'Quantity': item.quantity !== null ? item.quantity : ''
      }))
    );
    
    // Create a workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Grocery List');
    
    // Generate Excel file and download
    XLSX.writeFile(workbook, 'grocery-list.xlsx');
  };

  return (
    <div className="w-full overflow-auto">
      <div className="flex justify-end mb-4">
        <Button 
          onClick={handleExportToExcel} 
          variant="outline"
          className="flex items-center gap-2"
          disabled={items.length === 0}
        >
          <Download size={16} />
          Export to Excel
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tamil Name</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleItems.map((item, index) => (
            <TableRow 
              key={index}
              className="animate-fade-in animate-slide-in-from-right duration-500"
            >
              <TableCell className="font-medium">{item.tamil_name}</TableCell>
              <TableCell>{item.english_name}</TableCell>
              <TableCell>{item.weight}</TableCell>
              <TableCell>{item.quantity !== null ? item.quantity : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 