let test = {
    "102020": {"apple":1,"banana":2},
    "10024024": {"orange":3,"pineapple":4}
}
delete test["102020"]

test = [1,2,3]
test.splice(0,1)
console.log(test)