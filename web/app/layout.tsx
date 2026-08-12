import "./globals.css";

export const metadata = {
  title: "Idea2Video — One idea. One video. Ready for YouTube.",
  description: "Affordable AI YouTube video production for Indian creators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
