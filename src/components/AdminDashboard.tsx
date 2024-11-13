import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Upload, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { doc, collection, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCatalog } from '../hooks/useCatalog';
import { formatCurrency } from '../utils/formatters';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import type { CatalogProduct, ShopifyVariant } from '../types';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { products, loading, deleteAllProducts, fetchCatalog } = useCatalog();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const productsMap = new Map<string, CatalogProduct>();
          let totalVariants = 0;

          // First pass: Create base products
          results.data.forEach((row: any) => {
            if (!row.Handle || !row.Title) return;

            const handle = row.Handle;
            
            if (!productsMap.has(handle)) {
              productsMap.set(handle, {
                id: crypto.randomUUID(),
                handle,
                title: row.Title,
                body: row['Body (HTML)'] || '',
                vendor: row.Vendor || '',
                productType: row['Product Type'] || '',
                tags: (row.Tags || '').split(',').map((tag: string) => tag.trim()).filter(Boolean),
                published: row.Published === 'true',
                variants: [],
                images: [],
                basePrice: Infinity
              });
            }
          });

          // Second pass: Process variants and images
          results.data.forEach((row: any) => {
            if (!row.Handle) return;

            const product = productsMap.get(row.Handle);
            if (!product) return;

            // Add image if it exists and is unique
            const imageSrc = row['Image Src']?.trim();
            if (imageSrc && !product.images.includes(imageSrc)) {
              product.images.push(imageSrc);
            }

            // Parse variant data
            const variantPrice = parseFloat(row['Variant Price']) || 0;
            if (variantPrice <= 0) return;

            // Create variant
            const variant: ShopifyVariant = {
              id: row['Variant SKU'] || crypto.randomUUID(),
              sku: row['Variant SKU'] || '',
              option1Name: row['Option1 Name'] || '',
              option1Value: row['Option1 Value'] || '',
              option2Name: row['Option2 Name'] || '',
              option2Value: row['Option2 Value'] || '',
              option3Name: row['Option3 Name'] || null,
              option3Value: row['Option3 Value'] || null,
              price: variantPrice,
              inventoryQuantity: parseInt(row['Variant Inventory Qty'] || '0', 10),
              imageSrc: imageSrc || null,
              size: null,
              color: null
            };

            // Process options to determine size and color
            const options = [
              { name: variant.option1Name, value: variant.option1Value },
              { name: variant.option2Name, value: variant.option2Value },
              { name: variant.option3Name, value: variant.option3Value }
            ];

            options.forEach(option => {
              if (!option.name || !option.value) return;
              const nameLower = option.name.toLowerCase();
              if (nameLower.includes('size')) {
                variant.size = option.value;
              } else if (nameLower.includes('color') || nameLower.includes('colour')) {
                variant.color = option.value;
              }
            });

            // Add variant if it has valid options
            if (variant.option1Value || variant.option2Value || variant.option3Value) {
              product.variants.push(variant);
              totalVariants++;

              // Update base price if this variant has a lower price
              if (variant.price < product.basePrice) {
                product.basePrice = variant.price;
              }
            }
          });

          // Set default base price if no variants were found
          for (const product of productsMap.values()) {
            if (product.basePrice === Infinity) {
              product.basePrice = 0;
            }
          }

          const finalProducts = Array.from(productsMap.values());

          // Save to Firestore
          const catalogRef = doc(collection(db, 'catalog'), 'products');
          await setDoc(catalogRef, { products: finalProducts });

          setSuccess(`Successfully imported ${finalProducts.length} products with ${totalVariants} variants`);
          await fetchCatalog();
        } catch (err) {
          console.error('Error processing CSV:', err);
          setError('Failed to process CSV file. Please check the format.');
        } finally {
          setUploading(false);
        }
      },
      error: (err) => {
        console.error('CSV parsing error:', err);
        setError('Failed to parse CSV file. Please check the format.');
        setUploading(false);
      }
    });
  };

  const handleDeleteAll = async () => {
    const success = await deleteAllProducts();
    if (success) {
      setSuccess('All products have been deleted');
    } else {
      setError('Failed to delete products');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/squads')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Squads
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Products (CSV)</h2>
        
        <div className="flex items-center gap-4">
          <label className="flex-1">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-[#FF4D8D] transition-colors">
              <div className="text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-600">
                  {uploading ? 'Uploading...' : 'Upload CSV'}
                </span>
              </div>
            </div>
          </label>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-50 text-red-600 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors flex items-center"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Delete All Products
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-50 text-green-600 rounded-xl">
            {success}
          </div>
        )}
      </div>

      {/* Products List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Product Catalog</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4D8D] mx-auto"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No products in catalog
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Product</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Brand</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Price</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Variants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.title}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Upload className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">{product.title}</div>
                          <div className="text-sm text-gray-500">{product.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {product.productType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {product.vendor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {formatCurrency(product.basePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {product.variants.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}