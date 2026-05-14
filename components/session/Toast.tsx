type Props = {
  message: string;
};

export function Toast({ message }: Props) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 fade-in"
      style={{
        backgroundColor: "rgba(20, 20, 24, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "var(--color-ink-text)",
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}
