import {NextFunction, Request, Response} from 'express'
import hydra from './../services/hydra.js';
import config from '../config'
import {AdminApi, PublicApi, Configuration} from '@oryd/kratos-client'
import url from 'url';

// A simple express handler that shows the login / registration screen.
// Argument "type" can either be "login" or "registration" and will
// fetch the form data from ORY Kratos's Public API.
const adminEndpoint = new AdminApi(new Configuration({basePath: config.kratos.admin}))
const publicEndpoint = new PublicApi(new Configuration({basePath: config.kratos.public}))

export const authHandler = (type: 'login' | 'registration') => (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // The request is used to identify the login and registration request in ORY Kratos and return data like the csrf_token and so on.
    const request = req.query.flow

    //TODO: environment variable for protocol?
    //const currentLocation = `${req.protocol}://${req.headers.host}${req.url}`;
    console.log(`${req.protocol}://${req.headers.host}${req.url}`)
    const currentLocation = `https://${req.headers.host}${req.url}`;

    //TODO: use implemented express query method
    const query = url.parse(req.url, true).query;
    // TODO FIGURE OUT HOW TO DO LOGIN AND REGISTRATION PAGES WITHOUT COOKIE FOR KEEPING THE CHALLENGE
    let challenge = query.login_challenge || req.cookies.login_challenge;
    res.cookie("login_challenge", challenge);

    if (!request) {
        if (!challenge) {
            // 3. Initiate login flow with Kratos
            // prompt=login forces a new login from kratos regardless of browser sessions - this is important because we are letting Hydra handle sessions
            // redirect_to ensures that when we redirect back to this url, we will have both the initial hydra challenge and the kratos request id in query params
            //res.redirect(`${config.kratos.browser}/self-service/browser/flows/${type}?prompt=login`)
            res.redirect(`${config.kratos.browser}/self-service/${type}/browser?prompt=login&return_to=${currentLocation}`)
            return
        } else {
            // 1. Parse Hydra challenge from query params
            // The challenge is used to fetch information about the login request from ORY Hydra.
            // Means we have just been redirected from Hydra, and are on the login page
            // We must check the hydra session to see if we can skip login
            console.log("Checking Hydra Sessions");
            // 2. Call Hydra and check the session of this user
            return hydra.getLoginRequest(challenge)
                .then((hydraResponse: any) => {
                    // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
                    // the user.
                    if (hydraResponse.redirect_to) {
                        console.log("hydra: connected");
                        res.redirect(hydraResponse.redirect_to);
                    } else {
                        console.log("hydra: not connected, checking on kratos");

                        return publicEndpoint
                            .whoami(`ory_kratos_session=${req.cookies['ory_kratos_session']}`)
                            .then(response => {
                                console.log("kratos: connected");

                                const session: any = response.data

                                return hydra.acceptLoginRequest(challenge, {
                                    // All we need to do is to confirm that we indeed want to log in the user.
                                    subject: session?.identity?.traits?.email,
                                    remember: false,//Boolean(req.body.remember),

                                    // When the session expires, in seconds. Set this to 0 so it will never expire.
                                    remember_for: 3600,
                                })
                            })
                            .then((hydraResponse: any) => {
                                console.log("hydra: redirect", hydraResponse.redirect_to)

                                // All we need to do now is to redirect the user back to hydra!
                                res.redirect(hydraResponse.redirect_to)
                            })
                            .catch(() => {
                                console.log("kratos: not connected")

                                // 3. Initiate login flow with Kratos
                                // prompt=login forces a new login from kratos regardless of browser sessions - this is important because we are letting Hydra handle sessions
                                // redirect_to ensures that when we redirect back to this url, we will have both the initial hydra challenge and the kratos request id in query params
                                //res.redirect(`${config.kratos.browser}/self-service/browser/flows/${type}?prompt=login&return_to=${currentLocation}`)
                                res.redirect(`${config.kratos.browser}/self-service/${type}/browser?prompt=login&return_to=${currentLocation}`)
                            })
                    }
                })
                .catch((err: any) => {
                    console.error(err)
                    next(err)
                });
        }
    }

    const authRequest = type === 'login' ?
        adminEndpoint.getSelfServiceLoginFlow(request + "")
        : adminEndpoint.getSelfServiceRegistrationFlow(request + "")

    authRequest.then(response => {
        if (response.status == 404 || response.status == 410 || response.status == 403) {
            res.redirect(
                `${config.kratos.browser}/self-service/${type}/browser`
            )
            return
        } else if (response.status != 200) {
            return Promise.reject(response.data)
        }

        return response.data
    })
        .then((request?: any) => {
            if (!request) {
                res.redirect(`${config.kratos.browser}/self-service/${type}/browser`)
                return
            }

            res.render(type, {
                ...request,
                challenge,
                //TODO: define these parameters
                oidc: undefined,//methodConfig("oidc"),
                password: request?.ui,//methodConfig("password"),
                messages: request?.ui?.messages
            })
        })
        .catch((err) => {
            console.error(err)
            next(err)
        })
}
