import "./globals.css";

export const metadata = {
  title: "Construction Budget Manager",
  description: "Construction projects, budgets, expenses and payments"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
