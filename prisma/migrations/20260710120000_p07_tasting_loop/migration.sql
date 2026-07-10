-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'FR',
ADD COLUMN     "recapTokenHash" TEXT,
ADD COLUMN     "tastingRecapSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "resendMessageId" TEXT,
ADD COLUMN     "wineryId" TEXT;

-- CreateTable
CREATE TABLE "client_email_preferences" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_email_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wine_order_requests" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "wineryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wine_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wine_order_request_items" (
    "id" TEXT NOT NULL,
    "orderRequestId" TEXT NOT NULL,
    "wineId" TEXT NOT NULL,
    "wineName" TEXT NOT NULL,
    "grapeVariety" TEXT NOT NULL,
    "vintage" INTEGER,
    "priceAtRequest" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "wine_order_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_email_preferences_email_key" ON "client_email_preferences"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_email_preferences_unsubscribeToken_key" ON "client_email_preferences"("unsubscribeToken");

-- CreateIndex
CREATE UNIQUE INDEX "wine_order_requests_bookingId_key" ON "wine_order_requests"("bookingId");

-- CreateIndex
CREATE INDEX "wine_order_requests_wineryId_createdAt_idx" ON "wine_order_requests"("wineryId", "createdAt");

-- CreateIndex
CREATE INDEX "wine_order_request_items_orderRequestId_idx" ON "wine_order_request_items"("orderRequestId");

-- CreateIndex
CREATE INDEX "wine_order_request_items_wineId_idx" ON "wine_order_request_items"("wineId");

-- CreateIndex
CREATE INDEX "bookings_recapTokenHash_idx" ON "bookings"("recapTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_resendMessageId_key" ON "email_logs"("resendMessageId");

-- CreateIndex
CREATE INDEX "email_logs_wineryId_type_idx" ON "email_logs"("wineryId", "type");

-- AddForeignKey
ALTER TABLE "wine_order_requests" ADD CONSTRAINT "wine_order_requests_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wine_order_requests" ADD CONSTRAINT "wine_order_requests_wineryId_fkey" FOREIGN KEY ("wineryId") REFERENCES "wineries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wine_order_request_items" ADD CONSTRAINT "wine_order_request_items_orderRequestId_fkey" FOREIGN KEY ("orderRequestId") REFERENCES "wine_order_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wine_order_request_items" ADD CONSTRAINT "wine_order_request_items_wineId_fkey" FOREIGN KEY ("wineId") REFERENCES "wines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

