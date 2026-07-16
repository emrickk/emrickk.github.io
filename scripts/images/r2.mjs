import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export function makeClient(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

export async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false
    throw err
  }
}

export async function putObject(client, bucket, key, buffer, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}

export async function deleteObject(client, bucket, key) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
