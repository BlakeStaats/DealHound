"use client";

import { App, ConfigProvider } from "antd";

// One theme for the whole app: a single accent color, one radius, one type scale.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2f54eb",
          colorSuccess: "#389e0d",
          colorBgLayout: "#f5f6f8",
          borderRadius: 8,
          fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 14,
        },
        components: {
          Card: { paddingLG: 20 },
          Statistic: { contentFontSize: 22, titleFontSize: 12 },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
