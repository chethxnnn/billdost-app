'use client'

import React, { createContext, useContext } from 'react'

interface ShopContextType {
  shopId: string
  shopCategory: string
  shopName: string
}

const ShopContext = createContext<ShopContextType | undefined>(undefined)

export function ShopProvider({
  children,
  shopId,
  shopCategory,
  shopName,
}: {
  children: React.ReactNode
  shopId: string
  shopCategory: string
  shopName: string
}) {
  return (
    <ShopContext.Provider value={{ shopId, shopCategory: (shopCategory || '').toLowerCase(), shopName }}>
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const context = useContext(ShopContext)
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider')
  }
  return context
}
