import crypto from 'crypto'
import express from 'express'
import { Channel } from '../base/channel'
import { MessengerConduit } from './conduit'

export class MessengerChannel extends Channel<MessengerConduit> {
  get name() {
    return 'messenger'
  }

  get id() {
    return 'c4bb1487-b3bd-49b3-a3dd-36db908d165d'
  }

  protected createConduit() {
    return new MessengerConduit()
  }

  async setupRoutes() {
    this.router.use(express.json({ verify: this.auth.bind(this) }))

    this.router.get('/', async (req, res) => {
      const conduit = res.locals.conduit as MessengerConduit

      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']

      if (mode && token && mode === 'subscribe' && token === conduit.config.verifyToken) {
        this.logger.debug('Webhook Verified')
        res.send(challenge)
      } else {
        res.sendStatus(403)
      }
    })

    this.router.post('/', async (req, res) => {
      const conduit = res.locals.conduit as MessengerConduit
      const body = req.body

      for (const entry of body.entry) {
        const messages = entry.messaging

        for (const webhookEvent of messages) {
          if (!webhookEvent.sender) {
            continue
          }
          await conduit.receive(webhookEvent)
        }
      }

      res.send('EVENT_RECEIVED')
    })

    this.printWebhook()
  }

  private auth(req: any, res: any, buffer: any) {
    const conduit = res.locals.conduit as MessengerConduit

    const signature = req.headers['x-hub-signature']
    const [, hash] = signature.split('=')
    const expectedHash = crypto.createHmac('sha1', conduit.config.appSecret!).update(buffer).digest('hex')
    if (hash !== expectedHash) {
      throw new Error("Couldn't validate the request signature.")
    }
  }
}
