/**
 * Product display helpers for user-facing messages.
 * Use these so warnings/errors show product name (or code) instead of raw product_id (UUID).
 */

export type ProductLike = { id: string; product_name?: string | null; product_code?: string | null };

/**
 * Get a user-friendly label for a product (name > code > id).
 */
export function getProductDisplayLabel(
  product: ProductLike | null | undefined
): string {
  if (!product) return 'ไม่ทราบสินค้า';
  const name = product.product_name?.trim();
  const code = product.product_code?.trim();
  if (name) return name;
  if (code) return code;
  return product.id;
}

/**
 * Format a product-related warning message for display.
 * Prefer passing productName (or product object) so the message shows ชื่อสินค้า not UUID.
 *
 * Example:
 *   formatProductWarning(
 *     productId,
 *     product?.product_name ?? product?.product_code,
 *     'ไม่มี default Pallet Config - ใช้ config แรกในการคำนวณ (แนะนำให้เลือก default)'
 *   )
 *   => "สินค้า ชื่อสินค้าจริง ไม่มี default Pallet Config ..."
 */
export function formatProductWarning(
  productId: string,
  productNameOrCode: string | null | undefined,
  message: string
): string {
  const label = (productNameOrCode && productNameOrCode.trim()) || productId;
  return `สินค้า ${label} ${message}`;
}
