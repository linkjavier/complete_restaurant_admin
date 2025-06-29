"use client"

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from "@/components/theme-switch";
import React, { useEffect, useState } from "react"

export default function HomePage() {
  const [businessIcon, setBusinessIcon] = useState<string>("")
  const [businessName, setBusinessName] = useState<string>("Kutchen AI")
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await fetch("/api/settings/business")
        if (res.ok) {
          const data = await res.json()
          setBusinessIcon(data.logo || "")
          setBusinessName(data.name || "Kutchen AI")
        }
      } catch {}
    }
    fetchBusiness()
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="absolute top-4 right-4">
        <ThemeSwitch />
      </div>
      <div className="container flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Image
          src={businessIcon || "/assets/kutchen_app_logo.png"}
          alt="Logo Negocio"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Welcome to{' '}
          <span className="text-primary">{businessName}</span>
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