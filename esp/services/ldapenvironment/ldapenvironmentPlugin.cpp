/*##############################################################################

HPCC SYSTEMS software Copyright (C) 2022 HPCC Systems.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
############################################################################## */
#include "ldapenvironment_esp.ipp"

//ESP Bindings
#include "http/platform/httpprot.hpp"

//ESP Service
#include "ldapenvironmentService.hpp"

#include "espplugin.hpp"

extern "C"
{

//when we aren't loading dynamically
// Change the function names when we stick with dynamic loading.
ESP_FACTORY IEspService * esp_service_factory(const char * name, const char * type, IPropertyTree * cfg, const char * process)
{
    if (strieq(type, "ldapenvironment"))
    {
        CldapenvironmentEx * service = new CldapenvironmentEx;
        service->init(cfg, process, name);
        return service;
    }
    return nullptr;
}

ESP_FACTORY IEspRpcBinding * esp_binding_factory(const char * name, const char * type, IPropertyTree * cfg, const char * process)
{
    //binding names ending in _http are being added so the names can be made more consistent and can therefore be automatically generated
    //  the name also better reflects that these bindings are for all HTTP based protocols, not just SOAP
    //  both "SoapBinding" and "_http" names instantiate the same objects.
    if (strieq(type, "ldapenvironmentSoapBinding") || strieq(type, "ldapenvironment_http"))
    {
        CldapenvironmentSoapBinding * binding = new CldapenvironmentSoapBindingEx(cfg, name, process);
        return binding;
    }
    return nullptr;
}

ESP_FACTORY IEspProtocol * esp_protocol_factory(const char * name, const char * type, IPropertyTree * cfg, const char * process)
{
    return http_protocol_factory(name, type, cfg, process);
}

};
