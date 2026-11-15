import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "../providers";

// Ant Design is only used by the marketplace. The mock store pages and the oracle stay on the
// plain root layout so their HTML (and the JSON-LD the oracle reads) is fully server-rendered.
// AntdRegistry creates its style cache with a random id, so under cacheComponents it renders
// per request inside a Suspense boundary.
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AntdRegistry>
        <Providers>{children}</Providers>
      </AntdRegistry>
    </Suspense>
  );
}
