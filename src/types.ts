import { Timestamp } from 'firebase/firestore';

export interface ShopifyVariant {
  id: string;
  sku: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string | null;
  option3Value: string | null;
  price: number;
  inventoryQuantity: number;
  imageSrc: string | null;
  size: string | null;
  color: string | null;
}

export interface CatalogProduct {
  id: string;
  handle: string;
  title: string;
  body: string;
  vendor: string;
  productType: string;
  tags: string[];
  published: boolean;
  variants: ShopifyVariant[];
  images: string[];
  basePrice: number;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  description: string;
  vendor: string;
  productType: string;
  selectedVariant: {
    size: string;
    color: string;
  };
  addedBy: string;
  addedAt: Timestamp;
}

export interface Party {
  id: string;
  title: string;
  date: Timestamp;
  location: string;
  organizerId: string;
  organizer: string;
  participants: Participant[];
  products: Product[];
  createdAt: Timestamp;
  totalAmount?: number;
}

export interface Participant {
  id: string;
  name: string;
  avatar: string;
}