require('app-module-path').addPath(__dirname + '/../../')

import * as fs from 'fs';
import * as restify from 'restify';

import * as corsMiddleware from 'restify-cors-middleware'

import { Server } from 'catnapify';

import { settings } from './config/config';

import { messagesController } from './controllers/messages';
import { ridesController } from './controllers/rides';
import { usersController } from './controllers/users'

import { logger } from './services/logger';
import { db } from './services/db';
import { session, keyName } from './services/session';

const ATTEMPT_WAIT_TIME = 5000;

/*
 *
 * This will attempt to initialise the Openride RESTAPI
 * 
 */
function attemptInitialisation() {

	// Attempt to connect to Mongo

	return db.connect().catch((err:any) => {

		logger.error(`ERROR: ${settings.name} couldn\'t connect to MongoDB: ${err.message}`);
		throw err;

	}).then( () => {

	// Attempt to connect to Redis

		return session.init()
	
	}).catch( (err: any)=> {
	
		logger.error(`ERROR: ${settings.name} couldn\'t connect to Redis:`);
		logger.error(err);

		throw err;
	
	}).then( () => {
	
	// Attempt to initialise the server

		try {

			// Create a catnapify server
			let server = new Server(settings)

			// Include the CORS restify middleware
			let cors = corsMiddleware({
				origins: ['*'],
				allowHeaders: [keyName],
				exposeHeaders: [keyName]
			})

			server.api.pre(cors.preflight)
			server.api.use(cors.actual)

			// Create and link the controllers

			let rides = new ridesController;
			let users = new usersController;
			let messages = new messagesController;

			server.link(rides);
			server.link(messages);
			server.link(users);

			// Make the server listen to incoming connection
			server.listen()

			logger.info(`INFO: Server is listening on port ${ settings.port }`)

		}
		catch(err) {

			logger.error(`ERROR: Could not create server`)	
			logger.error(err)

		}

	})

}

function tryUntilResolved(what: Function) {

	console.log(`INFO: Attempting to initialise the server.`)

	what().catch(() => {
	
		setTimeout(() => tryUntilResolved(what), ATTEMPT_WAIT_TIME)	
	
	})

}

tryUntilResolved(attemptInitialisation)
