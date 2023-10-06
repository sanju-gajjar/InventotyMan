FROM node:18
ENV SESSION_SECRET=secret

ENV db_name=warehousedb

ENV db_user_name=rootas

ENV db_password=Example@123

ENV login_id=admin@xyz.com

ENV login_password=admin1234
# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --omit=dev

# Bundle app source
COPY . .

EXPOSE 8080
CMD [ "node", "server2.js" ]
