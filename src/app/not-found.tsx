import Image from "next/image";
import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <Image
          src="/rina/404.png"
          alt="404"
          width={280}
          height={280}
          className="mx-auto mb-8 object-contain"
          priority
        />
        <h1 className="text-4xl font-black text-text mb-3 tracking-tight">
          Lost in the void?
        </h1>
        <p className="text-text-muted mb-8 max-w-md mx-auto text-sm leading-relaxed">
          The page you’re looking for doesn’t exist or has been moved. 
          Even Catarina can’t find it — and she remembers everything.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-bg shadow-lg shadow-accent/20 hover:bg-accent-2 transition-colors"
          >
            <Home size={16} />
            Go Home
          </Link>
          <button
            onClick={() => history.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-5 py-2.5 text-sm font-semibold text-text hover:bg-surface transition-colors"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
