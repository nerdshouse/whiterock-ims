# Firestore Schema - Inventory Reorder Planning

## Collections

### 1. `warehouses`
- **Document ID**: auto-generated
- **Fields**:
  - `name` (string)
  - `location` (string, optional)
  - `createdAt` (timestamp)

### 2. `skus`
- **Document ID**: auto-generated (use `skuCode` as unique business key)
- **Fields**:
  - `skuCode` (string, unique)
  - `name` (string)
  - `category` (string)
  - `status` (string: "Active" | "Inactive")
  - `purchaseRate` (number)
  - `sellRate` (number)
  - `weightPerUnit` (number)
  - `createdAt` (timestamp)

### 3. `stock`
One document per warehouse-SKU combination. Document ID = `${warehouseId}_${skuCode}`.
- **Fields**:
  - `warehouseId` (string)
  - `skuCode` (string)
  - `currentStock` (number) — closing stock, manually updated
  - `dailyAvgSale` (number)
  - `leadTime` (number, days)
  - `updatedAt` (timestamp)

### 4. `purchaseOrders`
- **Document ID**: auto-generated
- **Fields**:
  - `poNumber` (string, e.g. "PO1", "PO2")
  - `warehouseId` (string)
  - `skuCode` (string)
  - `quantity` (number)
  - `etd` (timestamp) — Expected Delivery Date
  - `status` (string: "Pending" | "In Transit" | "Received")
  - `createdAt` (timestamp)

### 5. `stockMovements` (History)
- **Document ID**: auto-generated
- **Fields**:
  - `warehouseId` (string)
  - `skuCode` (string)
  - `changeType` (string: "manual_update" | "po_received")
  - `quantityDelta` (number)
  - `previousStock` (number)
  - `newStock` (number)
  - `timestamp` (timestamp)
  - `metadata` (map: poNumber?, userId?, etc.)

### 6. `users` (optional, for custom auth or profiles)
- **Document ID**: Firebase Auth UID or custom ID
- **Fields**:
  - `email` (string)
  - `createdAt` (timestamp)

## Indexes (Firestore)
- `stock`: composite index on (warehouseId, skuCode) for queries by warehouse
- `purchaseOrders`: composite index on (warehouseId, etd) for 60-day window; (status, etd)
- `stockMovements`: composite index on (warehouseId, timestamp) for history

## Derived / computed (not stored)
- Safety Stock = dailyAvgSale × leadTime
- Days Left = currentStock ÷ dailyAvgSale (when dailyAvgSale > 0)
- Stock-out Date = Today + Days Left
- Projected Sales = currentStock × sellRate (from SKU)
- Total Weight = currentStock × weightPerUnit (from SKU)
