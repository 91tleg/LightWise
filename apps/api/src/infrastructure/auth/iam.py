def allow_policy(principal_id: str, method_arn: str, context: dict) -> dict:
    arn_base = method_arn.rsplit("/", 3)[0]

    return {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Action": "execute-api:Invoke",
                "Effect": "Allow",
                "Resource": f"{arn_base}/*",
            }],
        },
        "context": context,
    }
