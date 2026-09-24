"use client";

/**
 * PasswordInput — Reusable password field with a show/hide toggle.
 * Accepts the same props as a native input (type is overridden) plus the
 * caller's styling via className. The trailing `pr-10` guarantees room for
 * the eye toggle regardless of the base padding utility passed in.
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted transition-colors hover:text-text"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}