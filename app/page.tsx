import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center gap-8 p-6">
      {/* Theme toggle in top-right */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Logo + green wall strip — pinned near top */}
      <div className="flex flex-col items-center mt-6">
        <div className="relative w-48 h-48">
          <Image
            src="/images/logo_millewee_transp.png"
            alt="Café-Brasserie Millewee"
            fill
            className="object-contain dark:brightness-0 dark:invert"
            priority
          />
        </div>
        <div className="w-full max-w-md h-8 -mt-2 rounded-lg overflow-hidden opacity-85">
          <Image
            src="/images/green-wall-1.PNG"
            alt=""
            width={800}
            height={20}
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Tagline */}
      <h1 className="font-display text-3xl font-bold text-primary text-center">
        Café-Brasserie Millewee
      </h1>
      <p className="text-muted-foreground text-center max-w-md">
        Spécialités de burgers et plats du jour — Luxembourg
      </p>

      {/* Sample buttons to verify theming */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Ajouter
        </button>
        <button className="bg-secondary text-secondary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Menu
        </button>
        <button className="bg-mw-green text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          Terrasse
        </button>
      </div>

      {/* Color swatch preview */}
      <div className="flex gap-2 mt-4">
        <div className="w-8 h-8 rounded-full bg-primary" title="Primary (amber)" />
        <div className="w-8 h-8 rounded-full bg-accent" title="Accent (sunflower)" />
        <div className="w-8 h-8 rounded-full bg-mw-green" title="Green wall" />
        <div className="w-8 h-8 rounded-full bg-mw-stone" title="Stone" />
        <div className="w-8 h-8 rounded-full bg-destructive" title="Destructive" />
      </div>

      <p className="text-xs text-muted-foreground">
        Toggle dark/light mode with the button in the top-right corner
      </p>
    </div>
  );
}
