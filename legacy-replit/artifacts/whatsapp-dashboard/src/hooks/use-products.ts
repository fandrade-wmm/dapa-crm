import { useListProducts, type ListProductsParams } from "@workspace/api-client-react";

export function useProducts(params?: ListProductsParams) {
  return useListProducts(params);
}
