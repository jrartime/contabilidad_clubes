"use client";

export function ConfirmSubmitButton({
  ariaLabel,
  children,
  className,
  message,
  style,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  message: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className={className}
      style={className ? style : { padding: "6px 10px", cursor: "pointer", ...(style ?? {}) }}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
