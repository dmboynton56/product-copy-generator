"use client";

type ProductTableProps = {
  products: Record<string, unknown>[];
  title?: string;
  emptyText?: string;
};

export function ProductTable({
  products,
  title = "Extracted Products",
  emptyText = "No products extracted yet.",
}: ProductTableProps) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {products.length === 0 ? (
        <p className="muted text-sm">{emptyText}</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Color</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={String(product.url ?? product.name)} className="border-b border-stone-100">
                  <td className="py-2 pr-4 align-top">{String(product.name ?? "Unknown")}</td>
                  <td className="py-2 pr-4 align-top">{String(product.price ?? "—")}</td>
                  <td className="py-2 pr-4 align-top">{String(product.color ?? "—")}</td>
                  <td className="py-2 align-top">
                    {product.url ? (
                      <a
                        className="text-blue-700 underline"
                        href={String(product.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View source
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
