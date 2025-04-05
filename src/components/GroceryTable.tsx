'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  return (
    <div className="w-full overflow-auto">
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
          {items.map((item, index) => (
            <TableRow key={index}>
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