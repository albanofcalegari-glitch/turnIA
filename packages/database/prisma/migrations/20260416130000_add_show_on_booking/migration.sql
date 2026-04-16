-- AddShowOnBookingToLoyalty
ALTER TABLE "loyalty_programs" ADD COLUMN "showOnBooking" BOOLEAN NOT NULL DEFAULT false;
