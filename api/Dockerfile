# OpenPath API — zero dependencies, so there is no npm install in this image.
#
# BUILD FROM THE REPO ROOT:     docker build -f api/Dockerfile .
FROM node:20-alpine

WORKDIR /api
COPY api/ ./

# The API validates against the same schema files the form renders from.
COPY schema/ /schema/

ENV NODE_ENV=production \
    PORT=8080 \
    SCHEMA_DIR=/schema \
    DATA_DIR=/data \
    TRUST_PROXY=1

RUN mkdir -p /data && chown -R node:node /data /api
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
