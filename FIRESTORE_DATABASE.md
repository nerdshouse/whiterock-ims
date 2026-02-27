# Firestore database (entire app data)

All application data is stored in Firestore. No localStorage or other databases are used.

## Collections

### 1. `warehouses`
- **Document ID**: auto-generated
- **Fields**: `name`, `location`, `createdAt` (timestamp)

### 2. `skus`
- **Document ID**: auto-generated (use `skuCode` as unique business key)
- **Fields**: `skuCode`, `name`, `category`, `status` ("Active" | "Inactive"), `purchaseRate`, `sellRate`, `weightPerUnit`, `pcsInBox`, `createdAt` (timestamp)

### 3. `stock`
One document per warehouse + SKU. **Document ID**: `{warehouseId}_{skuCode}` (sanitized).
- **Fields**: `warehouseId`, `skuCode`, `currentStock`, `dailyAvgSale`, `leadTime`, `safetyStockDays`, `seasonalBufferDays`, `growthBufferDays`, `safetyStock`, `seasonalBuffer`, `stockForGrowth`, `updatedAt` (timestamp), `closingStockUpdateDate` (timestamp, optional)

### 4. `purchaseOrders`
- **Document ID**: auto-generated
- **Fields**: `poNumber`, `warehouseId`, `skuCode`, `quantity`, `etd`, `eta` (optional), `status` ("Pending" | "In Transit" | "Received"), `statusReason` (optional), `createdAt`, `updatedAt` (timestamp)

### 5. `stockMovements`
- **Document ID**: auto-generated
- **Fields**: `warehouseId`, `skuCode`, `changeType`, `quantityDelta`, `previousStock`, `newStock`, `timestamp`, `metadata` (map)

### 6. `members`
Allow-list for sign-in (Google only). Only listed members can access the app.
- **Document ID**: auto-generated
- **Fields**: `email`, `displayName`, `role` ("Admin" | "User"), `uid` (set after first sign-in), `createdAt` (timestamp)

### 7. `locations`
Managed in Settings. Used as the Location dropdown when adding/editing warehouses.
- **Document ID**: auto-generated
- **Fields**: `name`, `createdAt` (timestamp)

## Security (firestore.rules)

All collections require `request.auth != null` for read and write. Deploy with:

```bash
npx firebase deploy --only firestore:rules
```

## Indexes (firestore.indexes.json)

- **stock**: `warehouseId` ASC, `skuCode` ASC, `__name__` ASC
- **stockMovements**: `warehouseId` ASC, `timestamp` DESC

Deploy with:

```bash
npx firebase deploy --only firestore:indexes
```

## Where data lives

| Feature        | Collection(s)     |
|----------------|-------------------|
| Warehouses     | `warehouses`      |
| SKU master     | `skus`            |
| Stock per WH+SKU | `stock`        |
| Purchase orders| `purchaseOrders`  |
| History / movements | `stockMovements` |
| Members (auth allow-list) | `members` |
| Locations (Settings) | `locations` |

Everything is persisted in Firestore; the app uses real-time listeners (`onSnapshot`) and does not cache to localStorage or any other store.
