# Grocery List Speech-to-Text Frontend

This is the frontend application for the Tamil/English Grocery List Speech-to-Text application. It provides a user interface for recording grocery lists and displaying the transcribed results.

## Features

- Audio recording directly in the browser
- Seamless integration with backend for transcription and translation
- Responsive UI built with Next.js and Shadcn/UI
- Display of grocery items with Tamil names, English names, and quantities

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [Shadcn/UI](https://ui.shadcn.com/) - Component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Click the "Start Recording" button and speak your grocery list in Tamil or English
2. Include quantities for each item (e.g., "2 kilos of rice", "500 grams of sugar")
3. Click "Stop Recording" when you're done
4. Wait for the backend to process your recording
5. View your structured grocery list in the table below

## Note

Make sure the backend server is running at http://localhost:8000 before attempting to record and transcribe audio.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
