param(
    [Parameter(Mandatory)]
    [string]$Tag
)

git push origin master
git push origin ":refs/tags/$Tag"
git tag -d $Tag
git tag $Tag
git push origin $Tag
