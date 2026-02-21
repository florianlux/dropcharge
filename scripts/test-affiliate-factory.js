#!/usr/bin/env node

/**
 * Affiliate Link Factory - Interactive Test Script
 * 
 * This script demonstrates the URL validation and affiliate URL building
 * functionality of the Affiliate Link Factory.
 */

// Constants
const MAX_SLUG_LENGTH = 72;

// Copy the core functions from affiliate-factory.js
function coerceUrl(raw = '') {
  try {
    const url = new URL(raw)
    // Only allow http and https protocols for security
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url
  } catch (err) {
    return null
  }
}

function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, MAX_SLUG_LENGTH) || null
}

function buildAffiliateUrl(productUrl, networkKey, trackerId, utmParams = {}) {
  const NETWORKS = {
    amazon: {
      label: 'Amazon',
      trackerParam: 'tag',
      defaultTracker: 'dropcharge-21'
    },
    custom: {
      label: 'Custom',
      trackerParam: null
    }
  }
  
  const network = NETWORKS[networkKey] || NETWORKS.custom
  const parsed = coerceUrl(productUrl)
  if (!parsed) return null
  
  if (network.trackerParam) {
    parsed.searchParams.set(
      network.trackerParam,
      trackerId || network.defaultTracker
    )
  }
  
  // Add UTM parameters if provided
  if (utmParams.utm_source) parsed.searchParams.set('utm_source', utmParams.utm_source)
  if (utmParams.utm_campaign) parsed.searchParams.set('utm_campaign', utmParams.utm_campaign)
  if (utmParams.utm_medium) parsed.searchParams.set('utm_medium', utmParams.utm_medium)
  
  return parsed.toString()
}

// Test cases
console.log('\n=== Affiliate Link Factory - Demo ===\n')

const testCases = [
  {
    name: 'Valid HTTPS URL',
    url: 'https://example.com/product',
    network: 'custom',
    expected: 'valid'
  },
  {
    name: 'Valid HTTP URL',
    url: 'http://example.com/product',
    network: 'custom',
    expected: 'valid'
  },
  {
    name: 'Amazon URL with tracking',
    url: 'https://amazon.com/dp/B08X123456',
    network: 'amazon',
    trackerId: 'test-21',
    expected: 'valid'
  },
  {
    name: 'URL with UTM parameters',
    url: 'https://example.com/product',
    network: 'custom',
    utmParams: {
      utm_source: 'tiktok',
      utm_campaign: 'summer-sale',
      utm_medium: 'social'
    },
    expected: 'valid'
  },
  {
    name: 'Invalid - JavaScript protocol (XSS attempt)',
    url: 'javascript:alert(1)',
    network: 'custom',
    expected: 'invalid'
  },
  {
    name: 'Invalid - FTP protocol',
    url: 'ftp://example.com/file',
    network: 'custom',
    expected: 'invalid'
  },
  {
    name: 'Invalid - No protocol',
    url: 'example.com',
    network: 'custom',
    expected: 'invalid'
  },
  {
    name: 'Invalid - Malformed URL',
    url: 'not a url at all',
    network: 'custom',
    expected: 'invalid'
  }
]

testCases.forEach(testCase => {
  console.log(`\n📝 Test: ${testCase.name}`)
  console.log(`   Input: ${testCase.url}`)
  
  const result = buildAffiliateUrl(
    testCase.url,
    testCase.network,
    testCase.trackerId,
    testCase.utmParams
  )
  
  if (testCase.expected === 'valid') {
    if (result) {
      console.log(`   ✅ Valid`)
      console.log(`   Result: ${result}`)
      
      // Show UTM params if present
      const url = new URL(result)
      const hasUtm = url.searchParams.has('utm_source') || 
                     url.searchParams.has('utm_campaign') || 
                     url.searchParams.has('utm_medium')
      if (hasUtm) {
        console.log(`   UTM Params:`)
        if (url.searchParams.has('utm_source')) {
          console.log(`     - source: ${url.searchParams.get('utm_source')}`)
        }
        if (url.searchParams.has('utm_campaign')) {
          console.log(`     - campaign: ${url.searchParams.get('utm_campaign')}`)
        }
        if (url.searchParams.has('utm_medium')) {
          console.log(`     - medium: ${url.searchParams.get('utm_medium')}`)
        }
      }
    } else {
      console.log(`   ❌ Expected valid, got invalid`)
    }
  } else {
    if (!result) {
      console.log(`   ✅ Correctly rejected`)
    } else {
      console.log(`   ❌ Expected invalid, got: ${result}`)
    }
  }
})

console.log('\n\n=== Slug Generation Demo ===\n')

const slugTests = [
  'PlayStation Store 50€ Guthaben',
  'Xbox Game Pass Ultimate',
  'Test Product With Special!@#$ Characters',
  'Über Spezial Produkt',
  'Product    With    Spaces',
]

slugTests.forEach(title => {
  const slug = slugify(title)
  console.log(`Title: "${title}"`)
  console.log(`Slug:  "${slug}"`)
  console.log(``)
})

console.log('\n=== Complete Example ===\n')

const exampleTitle = 'Nintendo eShop Card 50€'
const exampleUrl = 'https://amazon.de/dp/B08X123456'
const exampleSlug = slugify(exampleTitle)
const exampleAffiliateUrl = buildAffiliateUrl(
  exampleUrl,
  'amazon',
  'dropcharge-21',
  {
    utm_source: 'tiktok',
    utm_campaign: 'gaming-deals',
    utm_medium: 'social'
  }
)

console.log(`Product: ${exampleTitle}`)
console.log(`Slug: ${exampleSlug}`)
console.log(`Short Link: /go/${exampleSlug}`)
console.log(`Affiliate URL: ${exampleAffiliateUrl}`)
console.log(``)

console.log('✅ All demonstrations complete!\n')
