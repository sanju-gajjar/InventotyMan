FROM node:18
ENV SESSION_SECRET=sanju
ENV db_name=warehousedb
ENV db_user_name=root
ENV db_password=example
ENV login_id=sanju.g1@gmail.com
ENV login_password=Sanju@123
ENV PORT=5004

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
CMD [ "node", "server.js" ]
