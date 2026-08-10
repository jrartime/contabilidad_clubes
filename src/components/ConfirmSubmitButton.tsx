"use client";

export function ConfirmSubmitButton({
  ariaLabel,
  children,
  className,
  message,
  style,
  formAction,
  formNoValidate,
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  message: string;
  style?: React.CSSProperties;
  formAction?: (formData: FormData) => void | Promise<void>;
  formNoValidate?: boolean;
}) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className={className}
      style={className ? style : { padding: "6px 10px", cursor: "pointer", ...(style ?? {}) }}
      formAction={formAction}
      formNoValidate={formNoValidate}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
