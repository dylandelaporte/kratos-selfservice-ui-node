import {NextFunction, Request, Response} from 'express'
import config from '../config'
import {AdminApi, Configuration} from '@oryd/kratos-client'

const adminApi = new AdminApi(new Configuration({basePath: config.kratos.admin}))

export default (req: Request, res: Response, next: NextFunction) => {
  const request = req.query.flow

  // The request is used to identify the login and registration request and
  // return data like the csrf_token and so on.
  if (!request) {
    console.log('No request found in URL, initializing recovery flow.')
    res.redirect(`${config.kratos.browser}/self-service/browser/flows/recovery`)
    return
  }

  adminApi
    .getSelfServiceRecoveryFlow(request + "")
    .then(response => {
        if (response.status == 404) {
          res.redirect(
            `${config.kratos.browser}/self-service/browser/flows/recovery`
          )
          return
        } else if (response.status != 200) {
          return Promise.reject(response.data)
        }

        return response.data
      }
    ).then((request: any) => {
      // This helper returns a request method config (e.g. for the password flow).
      // If active is set and not the given request method key, it wil be omitted.
      // This prevents the user from e.g. signing up with email but still seeing
      // other sign up form elements when an input is incorrect.
      const methodConfig = (key: string) => {
        if (request?.active === key || !request?.active) {
          return request?.methods[key]?.config
        }
      }

      res.render('recovery', {
        ...request,
        token: methodConfig('token')
      })
    }
  ).catch((err: any) => next(err))
}
