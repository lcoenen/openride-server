import * as restify from 'restify';
import { logger } from '../services/logger';
import { db } from '../services/db';

import { Ride } from '../../../shared/models/ride';
import { RideMock } from '../../../shared/mocks/ride';

export default class ridesController {

	public get(req: restify.Request, res: restify.Response, next: restify.Next) {

		db
		  .db
		  .collection('rides')
		  .findOne(req.params.id)
		  .then((ans:any) => {
		
		    res.json(200, ans);
		
		});

		return next();

	}

	public getAll(req: restify.Request, res: restify.Response, next: restify.Next) {

		db
		  .db
		  .collection('rides')
		  .find()
		  .toArray()
		  .then((ans:any) => {
		
		    res.json(200, ans);
		
		});

		return next();

	}

	public post(req: restify.Request, res: restify.Response, next: restify.Next) {

                let toinsert: Ride = {
		  origin: req.params.origin,
		  destination: req.params.destination,
		  riding_time: req.params.riding_time,
		  payement: req.params.payement,
		  driver: {'@id': 'mememe'},
		  riders: []
		};

                db.db.collection('rides').insertOne(toinsert).then((ans) => {
		
		    res.json(201, ans);  
		
		});

		return next();

	}

        public del(req: restify.Request, res: restify.Response, next: restify.Next) {



	}

}
