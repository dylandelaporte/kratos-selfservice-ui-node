import {NextFunction, Request, Response} from 'express'
import config from '../config'
import {AdminApi, Configuration} from '@oryd/kratos-client'

const adminApi = new AdminApi(new Configuration({basePath: config.kratos.admin}))

export default (req: Request, res: Response, next: NextFunction) => {
  const request = req.query.flow

  // The request is used to identify the login and registration request and
  // return data like the csrf_token and so on.
  if (!request) {
    console.log('No request found in URL, initializing verify flow.')
    res.redirect(`${config.kratos.browser}/self-service/browser/flows/verification/email`)
    return
  }

  adminApi
    .getSelfServiceVerificationFlow(request + "")
    .then(response => {
        if (response.status == 404) {
          res.redirect(
            `${config.kratos.browser}/self-service/browser/flows/verification/email`
          )
          return
        } else if (response.status != 200) {
          return Promise.reject(response.data)
        }

        return response.data
      }
    ).then((request: any) => {
      res.render('verification', {
        ...request
      })
    }
  ).catch((err: any) => next(err))
}
