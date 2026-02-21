# Affiliate Link Factory - Implementation Documentation

## Overview

The Affiliate Link Factory is a feature that allows creating trackable affiliate links with UTM parameters through the admin interface. It includes URL validation, slug generation, and comprehensive tracking capabilities.

## Features Implemented

### 1. UTM Tracking Parameters
- **utm_source**: Track where the traffic comes from (e.g., "tiktok", "instagram")
- **utm_campaign**: Track specific campaigns (e.g., "winter-sale", "black-friday")
- **utm_medium**: Track the marketing medium (e.g., "social", "email", "paid")

### 2. URL Validation
- Only HTTP and HTTPS protocols accepted
- Rejects dangerous protocols (javascript:, ftp:, etc.)
- Validates URL format and structure
- Preserves existing query parameters

### 3. Slug Generation
- Auto-generates slugs from product title
- Allows custom slug input
- Prevents slug collisions with automatic retry
- Slugifies: converts to lowercase, replaces special chars, truncates to 72 chars

### 4. Enhanced UI
- Clean form with organized input fields
- Success display with:
  - Checkmark indicator
  - Copy buttons for both short link and affiliate URL
  - Preview link that opens in new tab
  - Styled result sections
- German language throughout for consistency

### 5. Security
- Protocol whitelist validation
- XSS prevention via javascript: URL blocking
- Input sanitization
- CodeQL scan passed with 0 alerts

## How to Use

### Access the Feature
1. Log into the admin dashboard at `/admin.html`
2. Navigate to the "Deals & Spotlights" tab
3. Find the "Affiliate Link Factory" section

### Create an Affiliate Link

#### Required Fields:
- **Produktname**: Name of the product/deal
- **Produkt URL**: The target URL (must be http:// or https://)

#### Optional Fields:
- **Netzwerk**: Amazon, G2A, or Custom (default: Custom)
- **Slug**: Custom slug (auto-generated from title if empty)
- **Tracking ID**: For Amazon affiliate tag (default: dropcharge-21)
- **Plattform**: Platform identifier (e.g., PSN, Xbox, Nintendo)
- **UTM Source**: Traffic source tracking
- **UTM Campaign**: Campaign tracking
- **UTM Medium**: Medium tracking
- **Preisinfo**: Price display (e.g., "29,99")
- **Priority**: Display priority (default: 120)
- **Start**: Start date/time for the deal
- **Beschreibung**: Deal description
- **Sofort aktiv schalten**: Auto-activate the deal (checked by default)

### Example Usage

#### Basic Amazon Link:
```
Produktname: PlayStation Store 50€ Guthaben
Netzwerk: Amazon
Produkt URL: https://amazon.de/dp/B08X123456
Tracking ID: dropcharge-21
Plattform: PSN
```

Result: `/go/playstation-store-50-guthaben`
Affiliate URL: `https://amazon.de/dp/B08X123456?tag=dropcharge-21`

#### Link with UTM Parameters:
```
Produktname: Nintendo eShop Card
Produkt URL: https://example.com/product/nintendo-card
UTM Source: tiktok
UTM Campaign: summer-sale
UTM Medium: social
```

Result: `/go/nintendo-eshop-card`
Affiliate URL: `https://example.com/product/nintendo-card?utm_source=tiktok&utm_campaign=summer-sale&utm_medium=social`

#### Custom Link with All Parameters:
```
Produktname: Xbox Game Pass Ultimate 3 Monate
Netzwerk: Custom
Produkt URL: https://store.xbox.com/product/CFQ7TTC0K6L8
Slug: xbox-gamepass-3m
UTM Source: instagram
UTM Campaign: gamepass-promo
UTM Medium: story
Plattform: Xbox
Preisinfo: 29,99
Priority: 150
```

Result: `/go/xbox-gamepass-3m`
Affiliate URL: `https://store.xbox.com/product/CFQ7TTC0K6L8?utm_source=instagram&utm_campaign=gamepass-promo&utm_medium=story`

## Database Schema

The affiliate links are stored in the `spotlights` table with the following UTM columns:

```sql
ALTER TABLE public.spotlights
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_medium text;
```

These columns are optional and can be NULL.

## API Endpoint

**Endpoint**: `/.netlify/functions/affiliate-factory`  
**Method**: POST  
**Authentication**: Requires admin token

### Request Body:
```json
{
  "title": "Product Name",
  "product_url": "https://example.com/product",
  "network": "custom",
  "slug": "custom-slug",
  "tracker_id": "affiliate-tag-21",
  "platform": "PSN",
  "utm_source": "tiktok",
  "utm_campaign": "winter-sale",
  "utm_medium": "social",
  "price": "29,99",
  "priority": 120,
  "description": "Deal description",
  "auto_live": true,
  "starts_at": "2024-01-01T00:00:00Z"
}
```

### Response (Success):
```json
{
  "ok": true,
  "slug": "product-name",
  "go_url": "/go/product-name",
  "affiliate_url": "https://example.com/product?utm_source=tiktok&utm_campaign=winter-sale&utm_medium=social"
}
```

### Response (Error):
```json
Status: 400
Body: "Invalid product_url"
```

## Testing

### Unit Tests
Run: `node tests/affiliate-factory-unit.test.js`

Coverage:
- ✅ URL validation (10 tests)
- ✅ Slug generation (9 tests)
- ✅ Affiliate URL building (10 tests)
- ✅ Security protocol validation
- ✅ All 29 tests passing

### E2E Tests
Run: `npm run test:e2e`

Coverage:
- Field validation
- URL validation (valid/invalid)
- Slug generation
- UTM parameter handling
- Amazon affiliate tags
- UI display verification
- Form clearing
- Copy/preview functionality

## Security

### Protocol Validation
Only these protocols are accepted:
- ✅ `http://`
- ✅ `https://`

These protocols are rejected:
- ❌ `javascript:` (XSS prevention)
- ❌ `ftp://`
- ❌ `file://`
- ❌ Any other protocol

### Input Sanitization
- URL parsing and validation
- Slug sanitization (lowercase, alphanumeric + hyphens)
- Special character removal
- SQL injection prevention via parameterized queries

### CodeQL Scan
- ✅ 0 security alerts
- ✅ All checks passed

## Troubleshooting

### "Invalid product_url" Error
- Ensure URL starts with `http://` or `https://`
- Check that URL is properly formatted
- Verify no typos in the protocol

### "Slug conflict" Error
- Try providing a custom slug
- The system will auto-retry with random numbers
- If persists, use a completely different slug

### Form Not Submitting
- Check that Produktname and Produkt URL are filled
- Verify Produkt URL has valid http/https protocol
- Check browser console for errors

### UTM Parameters Not Appearing
- Verify you filled in the UTM fields
- Check the affiliate URL in the result display
- UTM parameters are added as query parameters

## Future Enhancements

Potential improvements for future versions:
- [ ] QR code generation for links
- [ ] Click tracking statistics per link
- [ ] Bulk import from CSV
- [ ] Link expiration dates
- [ ] A/B testing for different UTM combinations
- [ ] Link performance analytics
- [ ] Automatic slug suggestions
- [ ] Link categories and tags

## Support

For issues or questions:
1. Check this documentation
2. Review test cases in `tests/` directory
3. Check admin console for error messages
4. Verify Supabase configuration
5. Ensure admin authentication is working
