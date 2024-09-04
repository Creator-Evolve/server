import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.string(),
  NODE_ENV: Joi.string().valid('local', 'development', 'production', 'test'),
  DATABASE_URL: Joi.string().required(),
  CLIENT_URL: Joi.string().required(),
  APP_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  TWELVE_LABS_API_KEY: Joi.string().required(),
  TWELVE_LABS_BASE_URL: Joi.string().required(),
  TWELVE_LABS_SIGNING_SECRET: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.string().required(),
  REDIS_PASSWORD: Joi.string().required(),
  OPEN_AI_API_KEY: Joi.string().required(),
  ANTHROPIC_API_KEY: Joi.string().required(),
  PERPLEXITY_API_KEY: Joi.string().required(),
  PERPLEXITY_API_URL: Joi.string().required(),
  PERPLEXITY_DEFAULT_MODEL: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_SEARCH_ENGINE_ID: Joi.string().required(),
  GOOGLE_API_KEY: Joi.string().required(),

  // temp email config
  GMAIL_PASS: Joi.string().required(),
  GMAIL_MAIL: Joi.string().required(),

  AWS_CLOUDFRONT_DISTRIBUTION: Joi.string().required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().required(),
  AWS_ACCESS_KEY_ID: Joi.string().required(),
  AWS_CLOUDFRONT_PRIVATE_KEY: Joi.string().required(),
  AWS_CLOUDFRONT_KEY_PAIR: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_BUCKET_NAME: Joi.string().required(),

  ELEVEN_LABS_API_KEY: Joi.string().required(),
  ELEVEN_LABS_BASE_URL: Joi.string().required(),

  DOLBY_API_KEY: Joi.string().required(),
  DOLBY_API_SECRET: Joi.string().required(),
  DOLBY_MEDIA_URI: Joi.string().required(),
  
  STABLE_DIFFUSION_API_KEY: Joi.string().required(),
  STABLE_DIFFUSION_API_URL: Joi.string().required(),
  
});
