const { normalizeFeedbackInput } = require('../dist/utils/feedbackValidation');
const { isValidSeznikProductId, getSeznikProductName } = require('../dist/utils/seznikCatalog');
const { SEZNIK_WEBSITE_PRODUCTS } = require('../dist/data/seznikWebsiteProducts');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

const sampleProductId = SEZNIK_WEBSITE_PRODUCTS[0].id;

assert(isValidSeznikProductId(sampleProductId), 'catalog product id is valid');
assert(!isValidSeznikProductId('not-a-real-id'), 'unknown product id is invalid');
assert(getSeznikProductName(sampleProductId) === SEZNIK_WEBSITE_PRODUCTS[0].name, 'product name lookup works');

const valid = normalizeFeedbackInput({
  area: 'pos',
  rating: 4,
  message: 'Great printer',
  platform: 'web',
  productId: sampleProductId,
});
assert(valid.ok === true, 'valid payload accepted');
if (valid.ok) {
  assert(valid.data.platform === 'web', 'platform normalized');
  assert(valid.data.productId === sampleProductId, 'product id preserved');
  assert(valid.data.productName === SEZNIK_WEBSITE_PRODUCTS[0].name, 'product name from catalog');
}

const missingProduct = normalizeFeedbackInput({
  message: 'Hello',
  platform: 'mobile',
});
assert(missingProduct.ok === false && missingProduct.error.includes('product'), 'missing product rejected');

const invalidProduct = normalizeFeedbackInput({
  message: 'Hello',
  platform: 'mobile',
  productId: 'fake-id-123',
});
assert(invalidProduct.ok === false && invalidProduct.error.includes('Invalid product'), 'invalid product rejected');

const invalidPlatform = normalizeFeedbackInput({
  message: 'Hello',
  platform: 'desktop',
  productId: sampleProductId,
});
assert(invalidPlatform.ok === false && invalidPlatform.error.includes('platform'), 'invalid platform rejected');

const missingMessage = normalizeFeedbackInput({
  message: '   ',
  platform: 'web',
  productId: sampleProductId,
});
assert(missingMessage.ok === false && missingMessage.error.includes('feedback'), 'empty message rejected');

const badRating = normalizeFeedbackInput({
  message: 'Hello',
  platform: 'web',
  productId: sampleProductId,
  rating: 6,
});
assert(badRating.ok === false && badRating.error.includes('Rating'), 'invalid rating rejected');

console.log('feedbackValidation tests passed');
