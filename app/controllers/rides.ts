import * as restify from 'restify';
import * as turf from 'turf';
import * as moment from 'moment';

import { ObjectID } from 'mongodb';
import * as cat from 'catnapify';

import { logger } from '../services/logger';
import { db } from '../services/db';
import { session, sessionRequest } from '../services/session';


import { Ride, RideType, isRide } from '../../../shared/models/ride';
import { Link } from '../../../shared/models/link';
import { Request } from '../../../shared/models/request';

const maxDistance: number = 30;


function isArrayOfRides(x: any): x is Ride[] {
	return x.filter != undefined &&
		!(x.filter((v:any) => {
			return !isRide(v);	
		}).length)
}

export class ridesController extends cat.Controller {

	public constructor() {

		super()

	}

	/*
	 *
	 * Route allowing to get a specific ride
	 *
	 */

	@cat.catnapify('get', '/api/rides/:id')
	@cat.need('id')
	@cat.give(isRide)
	public get(request: cat.Request) {

		logger.trace(`TRACE: catching get`)
		logger.info(`INFO: Catching a /rides/:id request. Id is ${request.req.params.id}`)

		console.log(`get`)

		return db
			.db
			.collection('rides')
			.findOne({_id: request.req.params.id})
			.then((ans:Ride) : cat.Answer<Ride> => {
				if(!ans) throw { code: 404, response: 'ERROR: No such ride' } ;
				return { code: 200, response: ans } ;
			});

	}

	/*
	 *
	 * Route allowing to get all rides
	 *
	 * @return array An array of rides
	 *
	 */
	@cat.catnapify('get', '/api/rides')
	@cat.give(isArrayOfRides)
	public getAll(request: cat.Request) {

		console.log(`getAll`)

		return db
			.db
			.collection('rides')
			.find()
			.toArray()
			.then((rides: Ride[]) => {

				return {code: 200, response: rides}

			}) /* It should work without this, but out of security, I return a proper Answer object */

	}

	/*
	 *
	 * This route allow to publish a new ride.
	 *
	 * In order to do that, the user have to PUT a new ride at the desired URL.
	 * The request have to contains all the field needed for a ride (see shared/models/ride)
	 *
	 */
	@cat.catnapify('put', '/api/rides/:id')
	@cat.need(isRide)
	@session.needAuthentification
	public put(request: cat.Request) {

		logger.info(`INFO: Catching a PUT /rides/:id request. Id is ${request.params.id}`)

		let toinsert: Ride = {
			_id: request.params.id, /* id is from the URL */
			origin: request.params.origin,
			destination: request.params.destination,
			riding_time: request.params.riding_time,
			payement: request.params.payement,
			type: request.params.type,
			riders: []
		};

		if(toinsert.type == RideType.REQUEST) toinsert.riders = [{'@id': `/api/users/${ (<sessionRequest>request).user._id }` }]
		else toinsert.driver = {'@id': `/api/users/${ (<sessionRequest>request).user._id }` }; 

		return db.db.collection('rides').insertOne(toinsert).then((ans) => {

			return { code: 201, response: ans };

		})

	}

	/* 
	 *
	 * This route is used to join or depart to/from a ride
	 *
	 * @args join should be set to the user that want to join
	 * @args depart should be set to the user that want to depart from the ride
	 * @args id is the ride id (set in the route)
	 *
	 * The join or depart argument should be a valid user ID
	 *
	 */
	@cat.catnapify('patch', '/api/rides/:id')
	@cat.logger({logger: logger})
	@cat.need((params: any) => {

		return (params.join !== undefined) || (params.depart !== undefined); 

	})
	public patch(request: cat.Request) {

		logger.info(`INFO: Catching a PATCH /rides/:id request. Id is ${request.req.params.id}`)

		return db
			.db
			.collection('rides')
			.findOne({_id: request.req.params.id})
			.then((ans:any) => {

				/* 
				 *
				 * If we cannot find the corresponding ride, throw an error 
				 *
				 */

				logger.info(`INFO: Trying to find the ride. Found ${ans._id}`)

				if(!ans) throw `ERROR: I could not find the ride ID ${request.req.params.id}`;

				return ans;

			}).then( (): Promise<any> => {

				logger.info(`INFO: Trying to execute the request`)

				if(request.req.params.join) {


					logger.info(`INFO: User ${request.req.params.join} want to join the ride`)

					/* 
					 *
					 * Adding the user to the set in MongoDB
					 * It is done using the Link format (see JsonP) { '@id': url }
					 * This is to ensure respect of the hyperlink format
					 * and thus that is's REST compliant
					 *
					 */
					return db.db.collection('rides').updateOne({
						_id: request.req.params.id
					}, {
						$addToSet: { riders: { '@id': `/api/users/${request.req.params.join}`}}
					});

				}
				else {

					logger.info(`INFO: User ${request.req.params.depart} want to depart the ride`)

					/* 
					 *
					 * If the 'depart' function is set, then remove the user from the set
					 *
					 */
					return db.db.collection('rides').updateOne({
						_id: request.req.params.id
					}, {
						$pull: { riders: { '@id': `/api/users/${request.req.params.depart}`}}
					});

				}
			})

	}

	// 	@catnapify.route('del', '/api/rides/:id')
	// 	@catnapify.modernify()
	// 	public del(burrito: catnapify.RestifyBurrito) {



	// 	}

	/*
	 *
	 * This route is used to know if the ride exists
	 *
	 * It returns a 200 if the ride is found in the database. 400 otherwise.
	 *
	 */
	@cat.catnapify('head', '/api/rides/:id')
	@cat.need('id')
	public head(req: cat.Request) {

		db
			.db
			.collection('rides')
			.findOne({_id: req.params.id})
			.then((ans:any) => {
				if(ans) return {code: 200, response: ''}	
				else return {code: 400, response: ''} 
			});

	}

	/*
	 * This route is used to return the rides matching the target
	 *
	 * The matching algorythm is based on four parameters:
	 *   - Origin
	 *   - Destination
	 *   - Payement option
	 *   - Time of departure
	 *
	 *	If everything goes smoothly, it should return a 200 with a set of Link objects
	 *	(i.e. an array {'@id': url} objects) representing the matched rides. Every URL should thus be
	 *	in the /api/rides/XXX domain.
	 *
	 */
	@cat.catnapify('get', '/api/rides/:id/matches')
	@cat.need('id')
	@cat.give((links: Link[]) => {

		console.log(`[χψω]checking`)
		console.log(links)
		return <boolean>Array.isArray(links) && links.filter((link) => link['@id'] !== undefined).length != 0
	
	})
	public getMatches(req: cat.Request){

		logger.info(`INFO: Catching a /rides/:id/matches. ID is ${ req.params.id }`)

		/*
		 *
		 * Select the rides arriving nearby 
		 * the matching destination
		 *
		 */

		let targetRide: Ride;

		return (() => {

			/*
			 *
			 * Selecting the target ride
			 *
			 */
			return db
				.db
				.collection('rides')
				.findOne({ _id: req.params.id })

		})().then((foundRide: Ride) => {

			if(!foundRide) {

				throw { code: 404, response: "I cannot find the target ride" };

			}

			targetRide = foundRide;

			let criterias = { 
				'origin.geometry': {
					$nearSphere: {
						$geometry: foundRide.origin.geometry,
						$maxDistance: maxDistance * 1000
					}},
				'_id': {'$ne': foundRide._id },
				'type': { '$ne': foundRide.type }	

			}

			logger.info(criterias)

			/*
			 *
			 * If there's a driver, I need to match it with people 
			 * who are requesting a ride (i.e. without driver)
			 *
			 */

			return db
				.db
				.collection('rides')
				.find(criterias)
				.toArray();

		}).then((rides: Ride[]) => {

			/*
			 *
			 * Filter the rides foming from the matching destination
			 *
			 */
			let filterRides : Link[] = rides.filter( (ride: Ride) : boolean => {

				return turf.distance(ride.destination, 
					targetRide.destination) < maxDistance;	

			}).sort((a,b) => {

				/*
				 *
				 * Compute a matching score based on distance, time, payement philosophy
				 *
				 */

				let destinationDistance = turf.distance(
					a.destination,
					b.destination);

				let originDistance = turf.distance(
					a.origin,
					b.origin);
				let payementDifference = a.payement - b.payement;

				const msPerWeek = (1000 * 60 * 60 * 24 * 7);

				let timeDifference = moment(a.riding_time).diff(b.riding_time);
				timeDifference = timeDifference > msPerWeek? msPerWeek : timeDifference;

				return (destinationDistance / (maxDistance * 1000)) +
					(originDistance / (maxDistance * 1000)) +
					payementDifference / 100 +
					timeDifference / msPerWeek 
			}).map((ride: Ride): Link => {

				return { '@id' : `/api/rides/${ ride._id }`}; 

			});

			/*
			 *
			 * Return the filtered ride with a code 200
			 *
			 */
			console.log(`returning filterrides`)
			console.log(filterRides)
			return filterRides;

		})

	}

	/*
	 * This entry point is used to get the request associated with a ride
	 *
	 * It gives a set of Link[] pointing to every users
	 * having requesting to join the ride.
	 *
	 *
	 * Will always answer a 200 with what he found
	 */
	@cat.catnapify('get', '/api/rides/:id/requests')
	@cat.need('id')
	//@cat.give((links: Link[]) => <boolean>Array.isArray(links) && links.filter((link) => link['@id'] !== undefined).length != 0)
	public getRequests(req: cat.Request){

		return db
			.db
			.collection("requests")
			.find({to: {'@id': `/api/rides/${ req.params.id }`}})
			.toArray()

	}

	/*
	 *
	 * This entry point allow the client to post a ride request.
	 *
	 * @params from The user originally requesting the ride
	 *
	 */
	@cat.catnapify('post', '/api/rides/:id/requests')
	@cat.need(['id', 'from'])
	public postRequests(req: cat.Request){

		let toinsert: Request = {

			from: req.params.from,
			to: { '@id': `/api/rides/${ req.params.id }` }

		};

		return db
			.db
			.collection("requests")
			.insertOne(toinsert).then((ans) => {

				return { code: 201, response: 'Created' }	

			}).catch((err) => {

				return { code: 400, response: err };

			});


	}

}
