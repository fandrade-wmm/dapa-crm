import React, { useState } from "react";
import { motion } from "framer-motion";
import { useProducts } from "@/hooks/use-products";
import { PageHeader, Card, LoadingScreen, ErrorState, Input, Badge } from "@/components/ui-elements";
import { Search, Package, Box, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function Products() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useProducts({ limit: 50 }); // Fetch more for local filtering demo

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorState message="No se pudo conectar con el catálogo de Odoo." />;

  const products = data?.products || [];
  
  // Local filtering for demo purposes
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <PageHeader 
        title="Catálogo de Productos" 
        description="Inventario sincronizado desde Odoo. La IA usa estos datos para responder a los clientes."
      />

      <div className="mb-8 max-w-md relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar producto o categoría..." 
          className="pl-12"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredProducts.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No se encontraron productos</h3>
          <p className="text-muted-foreground">Intenta con otra búsqueda o revisa la sincronización en Odoo.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product, i) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              key={product.id}
            >
              <Card className="h-full flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group border-border/50">
                {/* Product Image */}
                <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center ${product.imageUrl ? "hidden" : ""}`}>
                    <Box className="w-16 h-16 text-slate-300" />
                  </div>
                  <div className="absolute top-3 right-3">
                    {product.stock > 0 ? (
                      <Badge variant="success" className="shadow-sm backdrop-blur-md bg-emerald-100/90">En Stock ({product.stock})</Badge>
                    ) : (
                      <Badge variant="error" className="shadow-sm backdrop-blur-md bg-rose-100/90">Agotado</Badge>
                    )}
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {product.category || "General"}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-foreground leading-snug mb-4 line-clamp-2">
                    {product.name}
                  </h3>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                    <span className="text-2xl font-display font-bold text-primary">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="text-xs font-medium text-slate-400">ID: {product.id}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
