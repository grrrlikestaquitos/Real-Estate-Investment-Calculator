# The `app` stage is the shipped image: it builds the frontend and serves the
# result with the small Node static server (serve.mjs). devDependencies stay
# in the image so the lab's test runner can run the suite in-image
# (DEPLOYING.md: "what they need must be installed in it").
FROM node:22-slim AS app
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
USER 1000:1000
EXPOSE 8000
CMD ["node", "serve.mjs"]

# The test stage adds nothing: the suite needs only what `app` already has.
FROM app AS test
USER root
# Make the transform cache dir writable for the unprivileged test run.
RUN mkdir -p /app/node_modules/.vite && chown -R 1000:1000 /app/node_modules/.vite
USER 1000:1000

# Ship the app image, not the test tools.
FROM app
