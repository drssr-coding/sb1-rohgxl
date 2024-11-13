import { Timestamp } from 'firebase/firestore';

export interface Participant {
  id: string;
  name: string;
  avatar: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  brand: string;
}

export interface Product extends CatalogProduct {
  assignedTo?: string;
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