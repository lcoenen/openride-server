FROM node:10

WORKDIR /usr/src/openride
COPY package*.json ./
COPY makefile ./

RUN make install

COPY . .

RUN make
EXPOSE 3000

ENTRYPOINT make start
