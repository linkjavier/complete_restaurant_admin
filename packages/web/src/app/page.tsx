import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="container flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Image
          src="/assets/blondie-logo.png"
          alt="Blondie Restaurant App Logo"
          width={300}
          height={300}
          className="mb-6"
          priority
        />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Welcome to{' '}
          <span className="text-primary">Blondie Restaurant App</span>
        </h1>
        <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          A modern restaurant management system for multi-location restaurants and bakeries.
        </p>
        <div className="flex gap-4">
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/auth/register">Sign Up</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}