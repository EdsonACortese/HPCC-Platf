r := RECORD
    STRING fipCode;
    INTEGER4 heat;
END;

d := DATASET([  {'10001', 10}, 
                {'11001', 20}, 
                {'12001', 30}, 
                {'13001', 40}, 
                {'14001', 50}, 
                {'15001', 60}, 
                {'16001', 70}, 
                {'17001', 80}, 
                {'18001', 90}, 
                {'19001', 100}, 
                {'21001', 110}, 
                {'22001', 120}, 
                {'23001', 130}, 
                {'24001', 140}, 
                {'25001', 150}, 
                {'26001', 160}, 
                {'27001', 170}, 
                {'28001', 180}, 
                {'29001', 190}, 
                {'30001', 200}, 
                {'30001', 210}, 
                {'30001', 220}, 
                {'30001', 230}, 
                {'30001', 240}, 
                {'30001', 250}], r);

OUTPUT(d, {County := fipCode, Value := heat}, NAMED('Choropleth'));
